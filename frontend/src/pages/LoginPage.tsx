import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Box, Button, Container, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormValues) => {
    console.log('Login', data)
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
          <TextField margin="normal" fullWidth label="Email Address" {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
          <TextField margin="normal" fullWidth label="Password" type="password" {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
            Sign In
          </Button>
        </Box>
      </Box>
    </Container>
  )
}
