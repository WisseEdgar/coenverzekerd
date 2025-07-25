import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Search, Brain, FileText, ArrowRight } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Search,
      title: "Intelligente Polis Matching",
      description: "Voer simpelweg de klant eisen in en laat onze AI de beste polissen vinden.",
      content: (
        <Card className="bg-simon-green-light border-simon-green/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="bg-simon-green text-white px-3 py-1 rounded text-sm">
                  Klant eisen
                </div>
                <Button variant="outline" size="sm">Analyseer</Button>
              </div>
              <div className="text-sm text-muted-foreground">
                "Ik ben zelfstandig ondernemer en zoek een bedrijfsverzekering met aansprakelijkheid tot €1M en cyber risico dekking"
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-xs text-muted-foreground mb-1">Gevonden matches:</div>
                <div className="text-sm font-medium">3 van 47 polissen • 98% match accuracy</div>
              </div>
              <Button className="w-full bg-simon-green hover:bg-simon-green-dark">
                Toon Resultaten
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      icon: Brain,
      title: "Complexe Voorwaarden Begrijpen",
      description: "Geen tijd om door ingewikkelde polisvoorwaarden te lezen? Laat AI het voor je uitleggen.",
      content: (
        <Card className="bg-simon-blue-light border-simon-blue/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="bg-simon-blue text-white px-3 py-1 rounded text-sm">
                  Uitleggen
                </div>
                <Button variant="outline" size="sm">Engels</Button>
              </div>
              <div className="text-sm text-muted-foreground">
                "Deze polis dekt schade aan eigendommen van derden, maar uitsluitend wanneer deze schade het directe gevolg is van..."
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-xs text-muted-foreground mb-1">AI Uitleg:</div>
                <div className="text-sm">Deze verzekering betaalt alleen als je per ongeluk iemand anders zijn spullen beschadigt tijdens je werk.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      icon: FileText,
      title: "Document Vergelijking",
      description: "Vergelijk automatisch verschillende polissen en zie direct de verschillen in voorwaarden.",
      content: (
        <Card className="bg-gradient-card border-border">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-simon-green-light p-3 rounded">
                  <div className="text-xs font-medium text-simon-green mb-1">Polis A - Allianz</div>
                  <div className="text-sm">Dekking: €500K</div>
                  <div className="text-sm">Premium: €245/mnd</div>
                </div>
                <div className="bg-simon-blue-light p-3 rounded">
                  <div className="text-xs font-medium text-simon-blue mb-1">Polis B - ASR</div>
                  <div className="text-sm">Dekking: €750K</div>
                  <div className="text-sm">Premium: €298/mnd</div>
                </div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-xs text-muted-foreground mb-1">Belangrijkste verschillen:</div>
                <div className="text-sm">• ASR heeft 50% hogere dekking voor +22% premie</div>
                <div className="text-sm">• Allianz exclusief cyber risico, ASR inclusief</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      icon: Shield,
      title: "Realtime Beschikbaarheid",
      description: "Controleer direct of je klant in aanmerking komt en wat de actuele tarieven zijn.",
      content: (
        <Card className="bg-gradient-card border-border relative overflow-hidden">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Beschikbaarheidscheck</div>
                <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Live</div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Allianz Zakelijk</span>
                  <span className="text-green-600">✓ Beschikbaar</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>ASR Ondernemers</span>
                  <span className="text-green-600">✓ Beschikbaar</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Nationale Nederlanden</span>
                  <span className="text-orange-600">⚠ Extra info nodig</span>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Offerte Aanvragen
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-foreground mb-6">
            Krachtige Features voor <span className="text-simon-green">Verzekeringsadviseurs</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Ontdek hoe Simon's AI-gestuurde platform je helpt om sneller en accurater de juiste verzekeringen te vinden voor je klanten.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-20">
            {features.map((feature, index) => (
              <div key={index} className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}>
                {/* Content */}
                <div className="lg:w-1/2 space-y-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-simon-green/10 p-3 rounded-lg">
                      <feature.icon className="h-6 w-6 text-simon-green" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                  <Button className="bg-simon-green hover:bg-simon-green-dark group">
                    Probeer Nu
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* Visual */}
                <div className="lg:w-1/2">
                  {feature.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Klaar om Simon te proberen?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start vandaag nog met een gratis proefperiode en ervaar hoe AI je adviesproces kan verbeteren.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-simon-green hover:bg-simon-green-dark">
              Start Gratis Proef
            </Button>
            <Button size="lg" variant="outline">
              Plan een Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;