import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, Clock, Send, MessageSquare, Users, Building } from "lucide-react";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, subject: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      toast({
        title: "Bericht verzonden!",
        description: "Dank je wel voor je bericht. We nemen binnen 24 uur contact met je op.",
      });
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        subject: "",
        message: ""
      });
      setIsSubmitting(false);
    }, 1000);
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: "Kantoor Adres",
      details: ["Herengracht 123", "1015 BH Amsterdam", "Nederland"],
      color: "text-simon-green"
    },
    {
      icon: Phone,
      title: "Telefoon",
      details: ["+31 20 123 4567", "Ma-Vr: 9:00 - 18:00"],
      color: "text-simon-blue"
    },
    {
      icon: Mail,
      title: "Email",
      details: ["info@simon.nl", "support@simon.nl"],
      color: "text-simon-green"
    },
    {
      icon: Clock,
      title: "Openingstijden",
      details: ["Maandag - Vrijdag: 9:00 - 18:00", "Weekend: Op afspraak"],
      color: "text-simon-blue"
    }
  ];

  const reasons = [
    {
      icon: MessageSquare,
      title: "Demo Aanvragen",
      description: "Bekijk Simon in actie met een persoonlijke demonstratie"
    },
    {
      icon: Users,
      title: "Enterprise Oplossingen",
      description: "Aangepaste oplossingen voor grote verzekeringskantoren"
    },
    {
      icon: Building,
      title: "Partnership",
      description: "Interesse in samenwerking of integratie mogelijkheden"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-hero text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Neem Contact Op
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Heeft u vragen over Simon of wilt u een demo? We helpen u graag verder.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactInfo.map((item, index) => (
              <Card key={index} className="shadow-card hover:shadow-card-hover transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 mx-auto mb-4 rounded-full bg-simon-green-light flex items-center justify-center`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-simon-blue mb-2">{item.title}</h3>
                  {item.details.map((detail, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground">
                      {detail}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-2xl text-simon-blue flex items-center gap-2">
                  <Send className="h-6 w-6" />
                  Stuur ons een bericht
                </CardTitle>
                <CardDescription>
                  Vul het formulier in en we nemen zo snel mogelijk contact met u op.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Naam *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Uw volledige naam"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="uw@email.nl"
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company">Bedrijf</Label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        placeholder="Uw bedrijfsnaam"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefoon</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+31 6 12 34 56 78"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subject">Onderwerp *</Label>
                    <Select onValueChange={handleSelectChange} required>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecteer een onderwerp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo">Demo aanvragen</SelectItem>
                        <SelectItem value="pricing">Prijzen en pakketten</SelectItem>
                        <SelectItem value="enterprise">Enterprise oplossingen</SelectItem>
                        <SelectItem value="support">Technische ondersteuning</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                        <SelectItem value="other">Anders</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="message">Bericht *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Vertel ons hoe we u kunnen helpen..."
                      required
                      rows={5}
                      className="mt-1"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    variant="simon"
                    className="w-full"
                  >
                    {isSubmitting ? "Verzenden..." : "Bericht Verzenden"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Reasons to Contact */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-simon-blue mb-4">
                  Waarom contact opnemen?
                </h2>
                <p className="text-muted-foreground mb-6">
                  We zijn er om u te helpen het meeste uit Simon te halen. Van demo's tot enterprise oplossingen.
                </p>
              </div>

              <div className="space-y-4">
                {reasons.map((reason, index) => (
                  <Card key={index} className="border-l-4 border-l-simon-green">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-simon-green-light flex items-center justify-center flex-shrink-0">
                          <reason.icon className="h-5 w-5 text-simon-green" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-simon-blue mb-1">
                            {reason.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {reason.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Response Time */}
              <Card className="bg-simon-green-light/20 border-simon-green/20">
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-simon-green mx-auto mb-3" />
                  <h3 className="font-semibold text-simon-blue mb-2">
                    Snelle Reactietijd
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Wij reageren binnen 24 uur op alle berichten. Voor urgente zaken kunt u ons direct bellen.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-simon-green-light/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-simon-blue mb-6">
            Klaar om te beginnen?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start vandaag nog met een gratis demo en ervaar hoe Simon uw adviesproces kan verbeteren.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="simon" size="lg">
              Plan een Demo
            </Button>
            <Button variant="outline" size="lg">
              Bekijk Prijzen
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;