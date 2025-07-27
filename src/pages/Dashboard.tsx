import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, FileText, TrendingUp } from "lucide-react";
import { Routes, Route, useLocation } from "react-router-dom";
import Chat from "./Chat";
import Documents from "./Documents";
import Admin from "./Admin";

const Dashboard = () => {
  const location = useLocation();
  const isChatRoute = location.pathname === "/dashboard/chat";

  // If it's the chat route, render the full-screen chat without sidebar layout
  if (isChatRoute) {
    return <Chat />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Dashboard Header */}
          <header className="h-16 border-b border-border flex items-center px-6 bg-background">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-2xl font-bold text-simon-blue">Dashboard</h1>
          </header>
          
          {/* Dashboard Content */}
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/admin" element={<Admin />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/" element={
                <div className="max-w-7xl mx-auto space-y-6">
                  {/* Welcome Section */}
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-simon-blue mb-2">
                      Welkom terug bij Simon
                    </h2>
                    <p className="text-muted-foreground">
                      Hier is een overzicht van je recent activiteit
                    </p>
                  </div>
                  
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Totaal Klanten
                        </CardTitle>
                        <Users className="h-4 w-4 text-simon-green" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-simon-blue">142</div>
                        <p className="text-xs text-muted-foreground">
                          +12% t.o.v. vorige maand
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Zoekacties Vandaag
                        </CardTitle>
                        <Search className="h-4 w-4 text-simon-green" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-simon-blue">28</div>
                        <p className="text-xs text-muted-foreground">
                          +8 t.o.v. gisteren
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Polissen Gevonden
                        </CardTitle>
                        <FileText className="h-4 w-4 text-simon-green" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-simon-blue">1,248</div>
                        <p className="text-xs text-muted-foreground">
                          In database beschikbaar
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Succes Percentage
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-simon-green" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-simon-blue">94%</div>
                        <p className="text-xs text-muted-foreground">
                          Gemiddelde match score
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Quick Actions */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-simon-blue">Snelle Acties</CardTitle>
                      <CardDescription>
                        Start direct met je belangrijkste taken
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button variant="simon" className="h-20 flex-col gap-2">
                          <Search className="h-6 w-6" />
                          Nieuwe Klant Matching
                        </Button>
                        <Button variant="simon-outline" className="h-20 flex-col gap-2">
                          <Users className="h-6 w-6" />
                          Klant Toevoegen
                        </Button>
                        <Button variant="simon-light" className="h-20 flex-col gap-2">
                          <FileText className="h-6 w-6" />
                          Documenten Uploaden
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Recent Activity */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-simon-blue">Recente Activiteit</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-simon-green-light rounded-lg">
                          <div className="w-2 h-2 bg-simon-green rounded-full"></div>
                          <div className="flex-1">
                            <p className="font-medium">Perfecte match gevonden voor Jan de Vries</p>
                            <p className="text-sm text-muted-foreground">Autoverzekering - 96% match - 5 min geleden</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                          <div className="flex-1">
                            <p className="font-medium">Nieuwe documenten toegevoegd</p>
                            <p className="text-sm text-muted-foreground">Allianz polisvoorwaarden - 15 min geleden</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                          <div className="flex-1">
                            <p className="font-medium">Klant profiel bijgewerkt</p>
                            <p className="text-sm text-muted-foreground">Maria Jansen - 1 uur geleden</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              } />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;