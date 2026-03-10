import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);

const mockDeleteWhere = jest.fn().mockResolvedValue([]);
const mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

const mockSelectWhere = jest.fn();
const mockFrom = jest.fn(() => ({ where: mockSelectWhere }));
const mockSelect = jest.fn(() => ({ from: mockFrom }));

const mockDb = { select: mockSelect, delete: mockDelete };

jest.mock('../../shared/db', () => ({
  createDb: jest.fn(() => mockDb),
}));

jest.mock('../../shared/schema', () => ({
  photos: 'photos_table',
}));

jest.mock('drizzle-orm', () => ({
  and: jest.fn((...args) => ({ and: args })),
  isNotNull: jest.fn((col) => ({ isNotNull: col })),
  lte: jest.fn((col, val) => ({ lte: { col, val } })),
  inArray: jest.fn((col, vals) => ({ inArray: { col, vals } })),
}));

beforeEach(() => {
  s3Mock.reset();
  mockSelect.mockClear();
  mockFrom.mockClear();
  mockSelectWhere.mockReset();
  mockDelete.mockClear();
  mockDeleteWhere.mockReset().mockResolvedValue([]);
});

describe('purge-deleted-photos handler', () => {
  it('logs no-op and returns when no expired photos', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const { handler } = await import('../src/handler');
    await handler();

    expect(consoleSpy).toHaveBeenCalledWith('No expired photos to purge.');
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
    expect(mockDelete).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('deletes S3 objects and DB records for expired photos', async () => {
    const expired = [
      { id: 'id1', s3Key: 'users/u1/photos/a.jpg', thumbnailKey: 'users/u1/thumbnails/a.jpg' },
      { id: 'id2', s3Key: 'users/u1/photos/b.jpg', thumbnailKey: null },
    ];
    mockSelectWhere.mockResolvedValueOnce(expired);
    s3Mock.on(DeleteObjectsCommand).resolves({});
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const { handler } = await import('../src/handler');
    await handler();

    const s3Calls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(s3Calls).toHaveLength(1);
    const objects = s3Calls[0].args[0].input.Delete!.Objects!;
    expect(objects).toContainEqual({ Key: 'users/u1/photos/a.jpg' });
    expect(objects).toContainEqual({ Key: 'users/u1/thumbnails/a.jpg' });
    expect(objects).toContainEqual({ Key: 'users/u1/photos/b.jpg' });
    expect(objects).toHaveLength(3);

    expect(mockDelete).toHaveBeenCalledWith('photos_table');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Purged 2 photos'));

    consoleSpy.mockRestore();
  });

  it('batches S3 deletions when more than 1000 keys', async () => {
    // Generate 600 photos each with a thumbnail = 1200 keys → 2 S3 batches
    const expired = Array.from({ length: 600 }, (_, i) => ({
      id: `id${i}`,
      s3Key: `users/u1/photos/photo${i}.jpg`,
      thumbnailKey: `users/u1/thumbnails/photo${i}.jpg`,
    }));
    mockSelectWhere.mockResolvedValueOnce(expired);
    s3Mock.on(DeleteObjectsCommand).resolves({});
    jest.spyOn(console, 'log').mockImplementation();

    const { handler } = await import('../src/handler');
    await handler();

    const s3Calls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(s3Calls).toHaveLength(2);
    expect(s3Calls[0].args[0].input.Delete!.Objects!).toHaveLength(1000);
    expect(s3Calls[1].args[0].input.Delete!.Objects!).toHaveLength(200);
  });
});
