'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GraduationCap, Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError('')
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Email ou senha inválidos.')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Painel de marca — teal profundo, mesmo tom da sidebar */}
      <div className="hidden lg:flex lg:w-[44%] flex-col bg-sidebar-bg p-12">
        <div className="flex items-center gap-2.5">
          <div className="bg-teal rounded-lg p-1.5">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-wide" style={{ color: 'hsl(45 20% 92%)' }}>
            Vela
          </span>
        </div>

        <div className="mt-auto space-y-4">
          <h2 className="font-serif text-3xl leading-snug font-semibold" style={{ color: 'hsl(45 20% 92%)' }}>
            Cada aluno visível.
            <br />
            Cada decisão informada.
          </h2>
          <p className="text-sm leading-relaxed max-w-sm text-sidebar-text">
            Gestão escolar com frequência, desempenho SAEB e acompanhamento
            pedagógico em um só lugar — para toda a rede.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Marca visível só no mobile, onde o painel esquerdo some */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10">
            <div className="bg-teal rounded-lg p-1.5">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-wide text-foreground">Vela</span>
          </div>

          <h1 className="font-serif text-2xl font-semibold text-foreground">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-8">
            Use as credenciais fornecidas pela sua instituição.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@escola.pr.edu.br"
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : 'Entrar'}
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Contas de demonstração</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium">Administrador:</span> adm@adm.com.br / admin123</p>
              <p><span className="font-medium">Diretora A:</span> diretora@eeteixeira.pr.edu.br / diretor123</p>
              <p><span className="font-medium">Pedagoga A:</span> pedagoga@eeteixeira.pr.edu.br / ped123</p>
              <p><span className="font-medium">Prof. LP:</span> ana.batista@eeteixeira.pr.edu.br / prof123</p>
              <p><span className="font-medium">Secretaria:</span> secretaria@seduc.pr.gov.br / seduc2024</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
