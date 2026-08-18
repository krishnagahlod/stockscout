import { signup } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params?.error

  return (
    <div className="flex h-screen w-full items-center justify-center px-4 bg-muted/20">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            Welcome to StockScout. Enter your email below to create a new account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" action={signup}>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium leading-none">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <label htmlFor="password" className="text-sm font-medium leading-none">
                  Password
                </label>
              </div>
              <Input id="password" name="password" type="password" required />
            </div>
            
            {error && (
              <div className="text-sm text-destructive font-medium">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full">
              Sign Up
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <div className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{' '}
            <Link href="/auth/login" className="underline hover:text-primary">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
