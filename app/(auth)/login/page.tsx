"use client";

import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardAction,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { authService } from "@/app/lib/services/auth.services";

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage = () => {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const loginData: LoginFormData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const res = await authService.login(loginData.email, loginData.password);
    console.log(res);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-1/3">
        <Card>
          <CardHeader>
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>
              Enter email below to login to your account
            </CardDescription>
            <CardAction>
              <Button variant="link">
                <a href="/sign-up">Sign Up</a>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <form id="login-form" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@gmail.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                  />
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              form="login-form"
              type="submit"
              className="w-full cursor-pointer"
            >
              Login
            </Button>
            <Button variant="outline" className="w-full cursor-pointer">
              Login with Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
