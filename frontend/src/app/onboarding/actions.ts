'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const riskAppetite = formData.get('risk_appetite') as string
  const displayName = formData.get('display_name') as string

  // Upsert the profile
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      display_name: displayName,
      risk_appetite: riskAppetite,
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Failed to complete onboarding:', error)
    redirect('/onboarding?error=' + encodeURIComponent(error.message))
  }

  redirect('/')
}
