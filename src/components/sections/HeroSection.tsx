import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Users, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";
export const HeroSection = () => {
  return <section className="relative bg-gradient-to-br from-simon-green-light via-background to-simon-blue-light py-20 sm:py-32">
      <div className="absolute inset-0 bg-gradient-hero opacity-5"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-simon-blue mb-6">
            Verzekeringen matchen met{" "}
            <span className="text-simon-green">AI precisie</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">Coen helpt verzekeringsadviseurs om binnen seconden de perfecte polis te vinden voor elke klant. Geen eindeloos zoeken meer door documenten - laat AI het werk doen.</p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/auth">
              <Button variant="simon" size="xl" className="gap-2">
                Start gratis trial
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/features">
              <Button variant="simon-outline" size="xl">
                Bekijk demo
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Demo Preview Card */}
        <div className="max-w-4xl mx-auto mb-20">
          <Card className="bg-gradient-card shadow-card-hover border-0 p-6">
            <div className="bg-simon-green-light rounded-lg p-6 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-simon-green rounded-full"></div>
              </div>
              <div className="bg-simon-green text-white p-3 rounded-md inline-block">
                "Zoek beste autoverzekering voor 35-jarige met schadevrije jaren in Amsterdam"
              </div>
            </div>
            <div className="bg-background rounded-lg p-6 border">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-simon-green-light rounded-lg">
                  <span className="font-medium">✓ Nationale Nederlanden - All Risk Pro</span>
                  <span className="text-simon-green font-semibold">96% match</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">• ANWB Basis Plus</span>
                  <span className="text-muted-foreground">89% match</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">• Allianz Comfort</span>
                  <span className="text-muted-foreground">84% match</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Feature Icons */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-simon-green-light rounded-full flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-simon-green" />
            </div>
            <h3 className="text-lg font-semibold mb-2">10x Sneller</h3>
            <p className="text-muted-foreground">
              Van uren zoeken naar seconden resultaat
            </p>
          </div>
          
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-simon-green-light rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-simon-green" />
            </div>
            <h3 className="text-lg font-semibold mb-2">100% Accuraat</h3>
            <p className="text-muted-foreground">AI getraind op alle actuele polisvoorwaarden</p>
          </div>
          
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-simon-green-light rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-simon-green" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Tevreden Klanten</h3>
            <p className="text-muted-foreground">Betere service volledig op maat</p>
          </div>
        </div>
      </div>
    </section>;
};