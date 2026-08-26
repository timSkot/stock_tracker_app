'use client'

import FooterLink from '@/components/forms/FooterLink'
import InputField from '@/components/forms/InputField'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { signInWithEmail } from '@/lib/actions/auth.actions'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'

const SignIn = () => {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  })
  const onSubmit = async (data: SignInFormData) => {
    try {
      const result = await signInWithEmail(data)
      if (result.success) router.push('/')
    } catch (e) {
      console.error(e)
      toast.add({
        type: 'error',
        description: e instanceof Error ? e.message : 'Failed to sign in',
        priority: 'high',
      })
    }
  }

  return (
    <>
      <h1 className='form-title'>Log In Your Account </h1>

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
        <InputField
          name='email'
          label='Email'
          placeholder='contact@gmail.com'
          register={register}
          error={errors.email}
          validation={{
            required: 'Email is required',
            pattern: /^\w+@\w+\.\w+$/,
            message: 'Email address is required',
          }}
        />
        <InputField
          name='password'
          label='Password'
          placeholder='Enter a strong password'
          type='password'
          register={register}
          error={errors.password}
          validation={{ required: 'Password is required', minLength: 8 }}
        />

        <Button
          type='submit'
          disabled={isSubmitting}
          className='yellow-btn w-full mt-5'
        >
          {isSubmitting ? 'Logging' : 'Log In'}
        </Button>

        <FooterLink
          text='Don’t have an account?'
          linkText='Sign up'
          href='/sign-up'
        />
      </form>
    </>
  )
}

export default SignIn
