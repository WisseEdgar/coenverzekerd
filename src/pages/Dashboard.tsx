import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, FileText } from "lucide-react";
import { Routes, Route, useLocation } from "react-router-dom";
import Chat from "./Chat";
import Documents from "./Documents";
import Admin from "./Admin";
import Clients from "./Clients";
import Settings from "./Settings";
import { ProfileDropdown } from "@/components/layout/ProfileDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
interface RecentActivity {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  insuranceType?: string;
}
const Dashboard = () => {
  const location = useLocation();
  const isChatRoute = location.pathname === "/dashboard/chat";
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [clientStats, setClientStats] = useState({
    total: 0,
    weeklyChange: 0
  });
  const [todayChats, setTodayChats] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const {
    toast
  } = useToast();

  // Fetch recent chat activities and client stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: user
        } = await supabase.auth.getUser();
        if (!user.user) return;

        // Get the last 3 conversations with their latest messages
        const {
          data: conversations,
          error
        } = await supabase.from('conversations').select(`
            id,
            title,
            updated_at,
            messages (
              id,
              content,
              role,
              created_at
            )
          `).eq('user_id', user.user.id).order('updated_at', {
          ascending: false
        }).limit(3);
        if (error) {
          console.error('Error fetching recent activities:', error);
          return;
        }

        // Fetch client statistics
        const {
          data: allClients,
          error: clientError
        } = await supabase.from('client_profiles').select('created_at').eq('advisor_id', user.user.id);
        if (!clientError && allClients) {
          const now = new Date();
          const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
          const currentMonthClients = allClients.filter(client => new Date(client.created_at) >= oneMonthAgo).length;
          const previousMonthClients = allClients.filter(client => {
            const createdAt = new Date(client.created_at);
            return createdAt >= twoMonthsAgo && createdAt < oneMonthAgo;
          }).length;
          const monthlyChange = previousMonthClients > 0 ? Math.round((currentMonthClients - previousMonthClients) / previousMonthClients * 100) : 0;
          setClientStats({
            total: allClients.length,
            weeklyChange: monthlyChange
          });
        }

        // Fetch today's conversations count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const {
          data: todayConversations,
          error: conversationError
        } = await supabase.from('conversations').select('id').eq('user_id', user.user.id).gte('created_at', today.toISOString());
        if (!conversationError && todayConversations) {
          setTodayChats(todayConversations.length);
        }

        // Fetch total documents count
        const {
          data: allDocuments,
          error: documentsError
        } = await supabase.from('documents').select('id');
        if (!documentsError && allDocuments) {
          setTotalDocuments(allDocuments.length);
        }
        const activities: RecentActivity[] = conversations?.map(conv => {
          // Get the first user message to extract insurance context
          const userMessages = conv.messages?.filter(m => m.role === 'user') || [];
          const firstUserMessage = userMessages[0]?.content || '';

          // Simple pattern matching for insurance types
          const insuranceTypes = ['autoverzekering', 'auto verzekering', 'auto', 'woonhuis', 'woonhuisverzekering', 'huis', 'zorgverzekering', 'zorg', 'gezondheid', 'aansprakelijkheid', 'AVP', 'WA', 'bedrijfsverzekering', 'bedrijf', 'rechtsbijstand', 'reisverzekering', 'reis'];
          let detectedType = '';
          for (const type of insuranceTypes) {
            if (firstUserMessage.toLowerCase().includes(type)) {
              detectedType = type.charAt(0).toUpperCase() + type.slice(1);
              break;
            }
          }

          // Format timestamp
          const timeAgo = new Date(conv.updated_at).toLocaleString('nl-NL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
          return {
            id: conv.id,
            title: conv.title,
            content: detectedType ? `${detectedType} gesprek` : 'AI gesprek',
            timestamp: timeAgo,
            insuranceType: detectedType
          };
        }) || [];
        setRecentActivities(activities);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  // If it's the chat route, render the full-screen chat without sidebar layout
  if (isChatRoute) {
    return <Chat />;
  }
  return <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Dashboard Header */}
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-2xl font-bold text-simon-blue">Dashboard</h1>
            </div>
            <ProfileDropdown />
          </header>
          
          {/* Dashboard Content */}
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/admin" element={<Admin />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<div className="max-w-7xl mx-auto space-y-6">
                  {/* Welcome Section */}
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-simon-blue mb-2">Welkom terug bij Coen </h2>
                    <p className="text-muted-foreground">
                      Hier is een overzicht van je recent activiteit
                    </p>
                  </div>
                  
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Totaal Klanten</CardTitle>
                        <Users className="h-4 w-4 text-simon-green" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-simon-blue">{clientStats.total}</div>
                        
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
                        <div className="text-2xl font-bold text-simon-blue">{todayChats}</div>
                        
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
                        <div className="text-2xl font-bold text-simon-blue">{totalDocuments}</div>
                        
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button variant="simon" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/dashboard/chat'}>
                          <Search className="h-6 w-6" />
                          Nieuwe Klant Matching
                        </Button>
                        <Button variant="simon-outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/dashboard/clients?new=true'}>
                          <Users className="h-6 w-6" />
                          Klant Toevoegen
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
                        {recentActivities.length > 0 ? recentActivities.map((activity, index) => <div key={activity.id} className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${index === 0 ? 'bg-simon-green-light hover:bg-simon-green-light/80' : 'bg-muted hover:bg-muted/80'}`} onClick={() => window.location.href = '/dashboard/chat'}>
                              <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-simon-green' : 'bg-muted-foreground'}`}></div>
                              <div className="flex-1">
                                <p className="font-medium">{activity.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {activity.content} - {activity.timestamp}
                                </p>
                              </div>
                            </div>) : <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                            <div className="flex-1">
                              <p className="font-medium">Nog geen gesprekken</p>
                              <p className="text-sm text-muted-foreground">Start je eerste AI gesprek</p>
                            </div>
                          </div>}
                      </div>
                    </CardContent>
                  </Card>
                </div>} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>;
};
export default Dashboard;