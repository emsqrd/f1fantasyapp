import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  Globe,
  Smartphone,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="from-background to-muted/20 min-h-screen bg-gradient-to-b">
      {/* Hero Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-4">
              🏎️ The Ultimate F1 Fantasy Experience
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Race to Glory with
              <span className="block bg-gradient-to-r from-red-600 via-red-500 to-orange-500 bg-clip-text text-transparent sm:ml-4 sm:inline">
                F1 Fantasy Sports
              </span>
            </h1>
            <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
              Build your dream Formula 1 team, compete with friends, and experience the thrill of
              every race weekend like never before.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate({ to: '/sign-up' })} className="text-lg">
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg"
                onClick={() =>
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-muted/30 py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Why Choose F1 Fantasy Sports?</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Experience Formula 1 like never before with our comprehensive fantasy platform
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: 'Compete with Friends',
                description:
                  'Create leagues, invite friends, and battle for fantasy supremacy every race weekend.',
              },
              {
                icon: BarChart3,
                title: 'Real-time Analytics',
                description:
                  "Track your team's performance with detailed statistics and insights from every session.",
              },
              {
                icon: Target,
                title: 'Strategic Depth',
                description:
                  'Make crucial decisions on drivers, constructors, and team strategies that impact your success.',
              },
              {
                icon: Smartphone,
                title: 'Mobile Optimized',
                description:
                  'Manage your team anywhere with our responsive design that works perfectly on all devices.',
              },
              {
                icon: Zap,
                title: 'Live Updates',
                description:
                  'Get instant scoring updates during practice, qualifying, and race sessions.',
              },
              {
                icon: Globe,
                title: 'Global Community',
                description:
                  'Join thousands of F1 fans worldwide in the ultimate fantasy racing experience.',
              },
            ].map((feature, index) => (
              <Card key={index} className="text-center transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <feature.icon className="text-primary h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How It Works</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Get started in three simple steps and begin your F1 fantasy journey
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Build Your Team',
                description:
                  'Select your favorite drivers and constructors within budget constraints.',
              },
              {
                step: '2',
                title: 'Join a League',
                description:
                  'Create or join leagues with friends, family, or the global community.',
              },
              {
                step: '3',
                title: 'Race for Points',
                description: 'Earn points based on real F1 performance and climb the leaderboards.',
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="bg-primary text-primary-foreground mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold">
                  {step.step}
                </div>
                <h3 className="mb-4 text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-8 text-3xl font-bold sm:text-4xl">Join the Community</h2>
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { number: '10K+', label: 'Active Players' },
                { number: '500+', label: 'Leagues Created' },
                { number: '50K+', label: 'Teams Built' },
                { number: '24/7', label: 'Live Scoring' },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-primary mb-2 text-3xl font-bold sm:text-4xl">
                    {stat.number}
                  </div>
                  <div className="text-muted-foreground text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="from-primary/5 to-primary/10 border-primary/20 mx-auto max-w-4xl bg-gradient-to-r text-center">
            <CardHeader className="pb-8">
              <CardTitle className="mb-4 text-3xl font-bold sm:text-4xl">
                Ready to Start Racing?
              </CardTitle>
              <CardDescription className="text-lg">
                Join thousands of F1 fans and create your ultimate fantasy team today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Button size="lg" onClick={() => navigate({ to: '/sign-up' })} className="text-lg">
                  Get Started Free
                  <Star className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <div className="text-muted-foreground flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Free to play
                </div>
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  No credit card required
                </div>
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Start immediately
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/20 border-t py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center space-x-2">
              <Trophy className="text-primary h-6 w-6" />
              <span className="text-lg font-semibold">F1 Fantasy Sports</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2025 F1 Fantasy Sports. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
