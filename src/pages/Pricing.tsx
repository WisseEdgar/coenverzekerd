import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const Pricing = () => {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "For all kind of users",
      features: [
        "Limited access to AI Excel Bot",
        "Basic features",
        "Generation and explanation per month",
        "Access to our Chrome Extension",
        "Formula",
        "Text support"
      ],
      buttonText: "Get Started",
      buttonVariant: "outline" as const
    },
    {
      name: "Pro",
      price: "$5.99",
      period: "/month",
      description: "Best choice for first 2ks first",
      features: [
        "Access to our Chrome Extension",
        "Access to our Excel web in unlimited Formula generation per month",
        "Unlimited Formula explanation per month",
        "Unlimited VBA code generations per month",
        "Unlimited VBA code explanations per month",
        "Text support",
        "Priority support"
      ],
      buttonText: "Get Started",
      buttonVariant: "outline" as const
    },
    {
      name: "Pro Annual",
      price: "$49.99",
      period: "/year",
      description: "Yearly subscription Annual plan",
      features: [
        "Access to our Chrome Extension",
        "Access to our Excel web in unlimited Formula generation per month",
        "Unlimited Formula explanation per month",
        "Unlimited VBA code generations per month",
        "Unlimited VBA code explanations per month",
        "Text support",
        "Priority support"
      ],
      buttonText: "Get Started",
      buttonVariant: "simon" as const,
      badge: "BEST VALUE",
      highlighted: true
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple Pricing</h1>
          <p className="text-muted-foreground">For all kind of users</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.highlighted ? 'border-simon-green shadow-lg scale-105' : ''}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-simon-green text-white px-3 py-1 rounded-full text-sm font-medium">
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
          <h2 className="text-2xl font-bold mb-4">Access the power of AI</h2>
          <Button variant="simon" size="lg">
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;