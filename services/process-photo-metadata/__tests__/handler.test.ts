import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3Mock = mockClient(S3Client);

const mockWhere = jest.fn().mockResolvedValue([]);
const mockSet = jest.fn(() => ({ where: mockWhere }));
const mockUpdate = jest.fn(() => ({ set: mockSet }));

const mockOnConflictDoUpdate = jest.fn().mockResolvedValue([]);
const mockValues = jest.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = jest.fn(() => ({ values: mockValues }));

const mockDb = { insert: mockInsert, update: mockUpdate };

jest.mock('../../shared/db', () => ({
  createDb: jest.fn(() => mockDb),
}));

jest.mock('../../shared/schema', () => ({
  photos: 'photos_table',
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: unknown, val: unknown) => ({ col, val })),
}));

const mockExifReader = jest.fn();
jest.mock('exif-reader', () => mockExifReader);

const mockSharpMetadata = jest.fn().mockResolvedValue({
  width: 1920,
  height: 1080,
  format: 'jpeg',
  exif: undefined,
});

jest.mock('sharp', () => {
  return jest.fn(() => ({
    metadata: mockSharpMetadata,
  }));
});

function makeSqsEvent(key: string, size = 12345): SQSEvent {
  const s3Event = {
    Records: [
      {
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key, size },
        },
      },
    ],
  };
  return {
    Records: [
      {
        messageId: 'msg-1',
        body: JSON.stringify(s3Event),
      } as SQSEvent['Records'][0],
    ],
  };
}

const defaultLastModified = new Date('2024-01-15T12:00:00.000Z');

function makeS3Body(): Readable {
  const stream = new Readable();
  stream.push(Buffer.from('fake-image-data'));
  stream.push(null);
  return stream;
}

beforeEach(() => {
  s3Mock.reset();
  mockInsert.mockClear();
  mockValues.mockClear();
  mockOnConflictDoUpdate.mockClear();
  mockUpdate.mockClear();
  mockSet.mockClear();
  mockWhere.mockClear();
  mockExifReader.mockClear();
  mockSharpMetadata.mockResolvedValue({
    width: 1920,
    height: 1080,
    format: 'jpeg',
    exif: undefined,
  });
  s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'image/jpeg', LastModified: defaultLastModified });
});

describe('process-photo-metadata handler', () => {
  it('skips folder marker objects (keys ending with /)', async () => {
    const { handler } = await import('../src/handler');
    const result = await handler(makeSqsEvent('users/u1/')) as SQSBatchResponse;

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('skips keys that do not start with users/', async () => {
    const { handler } = await import('../src/handler');
    const result = await handler(makeSqsEvent('other/key/photo.jpg')) as SQSBatchResponse;

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it('downloads the object from S3 and extracts metadata', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/photo.jpg'));

    const calls = s3Mock.commandCalls(GetObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'users/u1/photo.jpg',
    });
  });

  it('upserts processing status then updates to completed with metadata', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/photo.jpg', 12345));

    // Phase 1: insert with processing status
    expect(mockInsert).toHaveBeenCalledWith('photos_table');
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        s3Key: 'users/u1/photo.jpg',
        filename: 'photo.jpg',
        size: 12345,
        status: 'processing',
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { status: 'processing' } }),
    );

    // Phase 3: update to completed (no EXIF, no date in filename → takenAt falls back to S3 LastModified)
    expect(mockUpdate).toHaveBeenCalledWith('photos_table');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        width: 1920,
        height: 1080,
        format: 'jpeg',
        contentType: 'image/jpeg',
        takenAt: defaultLastModified,
      }),
    );
  });

  it('returns batchItemFailures when S3 download fails', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('S3 error'));

    const { handler } = await import('../src/handler');
    const result = await handler(makeSqsEvent('users/u1/photo.jpg')) as SQSBatchResponse;

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
  });

  it('extracts takenAt from EXIF DateTimeOriginal', async () => {
    const takenDate = new Date('2023-06-15T10:30:00.000Z');
    const fakeExif = Buffer.from('fake-exif');
    mockSharpMetadata.mockResolvedValue({
      width: 4000,
      height: 3000,
      format: 'jpeg',
      exif: fakeExif,
    });
    mockExifReader.mockReturnValue({
      exif: { DateTimeOriginal: takenDate },
    });

    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/photo.jpg'));

    expect(mockExifReader).toHaveBeenCalledWith(fakeExif);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: takenDate }),
    );
  });

  it('falls back to Image.DateTime when DateTimeOriginal is absent', async () => {
    const takenDate = new Date('2022-01-01T00:00:00.000Z');
    const fakeExif = Buffer.from('fake-exif');
    mockSharpMetadata.mockResolvedValue({
      width: 800,
      height: 600,
      format: 'jpeg',
      exif: fakeExif,
    });
    mockExifReader.mockReturnValue({
      exif: {},
      image: { DateTime: takenDate },
    });

    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/photo.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: takenDate }),
    );
  });

  it('falls back to S3 LastModified for images without EXIF (e.g. PNG)', async () => {
    mockSharpMetadata.mockResolvedValue({
      width: 100,
      height: 100,
      format: 'png',
      exif: undefined,
    });

    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/photo.png'));

    expect(mockExifReader).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: defaultLastModified }),
    );
  });

  it('falls back to filename date when EXIF is corrupt', async () => {
    const fakeExif = Buffer.from('corrupt-exif');
    mockSharpMetadata.mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      exif: fakeExif,
    });
    mockExifReader.mockImplementation(() => { throw new Error('Invalid EXIF'); });

    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    const result = await handler(makeSqsEvent('users/u1/IMG_20231215_103045.jpg')) as SQSBatchResponse;

    expect(result.batchItemFailures).toHaveLength(0);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: new Date('2023-12-15T10:30:45') }),
    );
  });

  it('extracts takenAt from iOS/macOS share filename (YYYY-MM-DD HH.MM.SS)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/2026-03-02 17.08.14.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: new Date('2026-03-02T17:08:14') }),
    );
  });

  it('extracts takenAt from Android filename (IMG_YYYYMMDD_HHMMSS)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/IMG_20230615_143022.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: new Date('2023-06-15T14:30:22') }),
    );
  });

  it('extracts takenAt from Screenshot filename (Screenshot_YYYYMMDD-HHMMSS)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/Screenshot_20230615-143022.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: new Date('2023-06-15T14:30:22') }),
    );
  });

  it('extracts date from WhatsApp filename (IMG-YYYYMMDD-WA0001)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/IMG-20231215-WA0001.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: new Date('2023-12-15') }),
    );
  });

  it('falls back to S3 LastModified when filename has no recognisable date (e.g. iOS IMG_1234)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/IMG_1234.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: defaultLastModified }),
    );
  });

  it('uses S3 LastModified as fallback when both EXIF and filename date are absent', async () => {
    const customLastModified = new Date('2023-09-20T08:00:00.000Z');
    s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'image/jpeg', LastModified: customLastModified });
    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
    });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/photo.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: customLastModified }),
    );
  });

  it('uses S3 LastModified for video files (no image processing)', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'video/mp4', LastModified: defaultLastModified });

    const { handler } = await import('../src/handler');
    await handler(makeSqsEvent('users/u1/video.mp4'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'video/mp4',
        takenAt: defaultLastModified,
        width: null,
        height: null,
        format: null,
      }),
    );
  });

  it('prefers EXIF DateTimeOriginal over filename date', async () => {
    const exifDate = new Date('2020-01-01T00:00:00.000Z');
    const fakeExif = Buffer.from('real-exif');
    mockSharpMetadata.mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      exif: fakeExif,
    });
    mockExifReader.mockReturnValue({ exif: { DateTimeOriginal: exifDate } });

    s3Mock.on(GetObjectCommand).resolves({
      Body: makeS3Body() as never,
      ContentType: 'image/jpeg',
    });

    const { handler } = await import('../src/handler');
    // filename has a different date — EXIF should win
    await handler(makeSqsEvent('users/u1/IMG_20231215_103045.jpg'));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ takenAt: exifDate }),
    );
  });
});
