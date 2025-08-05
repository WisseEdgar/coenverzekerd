import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: "€79",
      period: "/maand",
      description: "Perfect voor zelfstandig adviseurs",
      features: [
        "Tot 50 AI gesprekken per maand",
        "Basis verzekering database toegang",
        "Email ondersteuning",
        "Standaard polisanalyse",
        "Client profiel opslag",
        "Basis rapportage",
        "1 gebruiker account"
      ],
      buttonText: "Start Nu",
      buttonVariant: "outline" as const
    },
    {
      name: "Professional",
      price: "€149",
      period: "/maand",
      description: "Ideaal voor groeiende makelaarskantoren",
      features: [
        "Onbeperkte AI gesprekken",
        "Volledige verzekering database",
        "Prioriteit ondersteuning",
        "Geavanceerde polisanalyse",
        "Onbeperkte client profielen",
        "Uitgebreide rapportage & analytics",
        "Tot 5 gebruikers",
        "Integratie met bestaande systemen",
        "Custom branded interface"
      ],
      buttonText: "Start Nu",
      buttonVariant: "coenverzekerd" as const,
      badge: "MEEST POPULAIR",
      highlighted: true
    },
    {
      name: "Enterprise",
      price: "€299",
      period: "/maand",
      description: "Voor grote verzekeringskantoren",
      features: [
        "Alles van Professional",
        "Onbeperkte gebruikers",
        "Dedicated account manager",
        "24/7 telefonische ondersteuning",
        "Custom AI training op uw data",
        "API toegang voor integraties",
        "Advanced compliance tools",
        "Maandelijkse strategiesessies",
        "White-label oplossing",
        "SLA garanties"
      ],
      buttonText: "Neem contact op",
      buttonVariant: "outline" as const
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Eenvoudige Prijzen</h1>
          <p className="text-muted-foreground">Kies het plan dat bij uw kantoor past</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.highlighted ? 'border-simon-green shadow-lg scale-105' : ''}`}
            >
              {plan.badge && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-simon-green text-white px-2 py-0.5 rounded-full text-xs font-medium shadow-sm">
                  {plan.badge}
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-simon-green mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={plan.buttonVariant} 
                  className="w-full"
                >
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="bg-simon-green-light/20 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ervaar de kracht van AI voor verzekeringen</h2>
          <p className="text-muted-foreground mb-6">
            Start vandaag nog met een gratis proefperiode van 14 dagen
          </p>
          <Button variant="coenverzekerd" size="lg">
            Start Gratis Proef
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;