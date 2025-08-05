import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welkom terug!",
          description: "Je bent succesvol ingelogd.",
        });

        // Redirect to dashboard
        window.location.href = "/dashboard";
      } else {
        // Sign up new user
        const redirectUrl = `${window.location.origin}/dashboard`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: name,
              company_name: company,
            }
          }
        });

        if (error) throw error;

        toast({
          title: "Account aangemaakt!",
          description: "Controleer je e-mail om je account te verifiëren.",
        });

        // Clear form
        setEmail("");
        setPassword("");
        setName("");
        setCompany("");
      }
    } catch (error: any) {
      toast({
        title: "Fout",
        description: error.message || "Er is een fout opgetreden. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-coenverzekerd-green-light via-background to-coenverzekerd-blue-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to home */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-coenverzekerd-green hover:text-coenverzekerd-green-dark mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar home
        </Link>

        <Card className="shadow-card-hover border-0">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-coenverzekerd-green" />
              <span className="text-2xl font-bold text-coenverzekerd-blue">Coenverzekerd</span>
            </div>
            <div>
              <CardTitle className="text-2xl text-coenverzekerd-blue">
                {isLogin ? "Welkom terug" : "Account aanmaken"}
              </CardTitle>
              <CardDescription>
                {isLogin 
                  ? "Log in om door te gaan naar je dashboard" 
                  : "Maak een account aan en start direct"}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Volledige naam</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Jan de Vries"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company">Bedrijfsnaam</Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="Verzekeringskantoor Jansen"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required={!isLogin}
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jan@verzekeringskantoor.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" variant="coenverzekerd" className="w-full" size="lg" disabled={loading}>
                {loading ? "Bezig..." : (isLogin ? "Inloggen" : "Account aanmaken")}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Nog geen account?" : "Al een account?"}
              </p>
              <Button
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-coenverzekerd-green hover:text-coenverzekerd-green-dark p-0 h-auto font-medium"
              >
                {isLogin ? "Registreer nu gratis" : "Log hier in"}
              </Button>
            </div>
            
            {!isLogin && (
              <div className="mt-6 p-4 bg-coenverzekerd-green-light rounded-lg">
                <p className="text-sm text-coenverzekerd-green font-medium mb-2">
                  ✓ 14 dagen gratis proberen
                </p>
                <p className="text-xs text-muted-foreground">
                  Geen creditcard vereist. Opzeggen wanneer je wilt.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;