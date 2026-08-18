import { completeOnboarding } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params?.error

  return (
    <div className="flex h-screen w-full items-center justify-center px-4 bg-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to StockScout</CardTitle>
          <CardDescription>
            Let's set up your investor profile before we begin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6" action={completeOnboarding}>
            <div className="grid gap-2">
              <label htmlFor="display_name" className="text-sm font-medium leading-none">
                Display Name
              </label>
              <Input
                id="display_name"
                name="display_name"
                type="text"
                placeholder="How should we call you?"
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="risk_appetite" className="text-sm font-medium leading-none">
                Risk Appetite
              </label>
              <select 
                id="risk_appetite" 
                name="risk_appetite"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="conservative">Conservative (Focus on capital preservation & dividends)</option>
                <option value="moderate">Moderate (Balance of growth and safety)</option>
                <option value="aggressive">Aggressive (Focus on high growth, willing to take risks)</option>
              </select>
            </div>
            
            {error && (
              <div className="text-sm text-destructive font-medium">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full">
              Complete Setup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
