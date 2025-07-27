import { NavLink, useLocation, Link } from "react-router-dom";
import { Users, Search, FileText, Settings, BarChart3, Home, MessageSquare, Folder } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { AdminOnly } from "@/components/admin/AdminOnly";
const mainItems = [{
  title: "Dashboard",
  url: "/dashboard",
  icon: Home
}, {
  title: "Klant Matching",
  url: "/dashboard/matching",
  icon: Search
}, {
  title: "Klanten",
  url: "/dashboard/clients",
  icon: Users
}, {
  title: "Resultaten",
  url: "/dashboard/results",
  icon: BarChart3
}];
const toolsItems = [{
  title: "AI Chat",
  url: "/dashboard/chat",
  icon: MessageSquare
}, {
  title: "Templates",
  url: "/dashboard/templates",
  icon: Folder
}];

const adminToolsItems = [{
  title: "Documenten",
  url: "/dashboard/documents",
  icon: FileText
}];
const settingsItems = [{
  title: "Instellingen",
  url: "/dashboard/settings",
  icon: Settings
}];

const adminItems = [{
  title: "Beheer",
  url: "/dashboard/admin",
  icon: Settings
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({
    isActive
  }: {
    isActive: boolean;
  }) => isActive ? "bg-simon-green text-black font-medium hover:bg-simon-green-dark" : "text-black hover:bg-simon-green-light hover:text-simon-green";
  return <Sidebar collapsible="icon">
      <SidebarContent className="bg-background border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BarChart3 className="h-8 w-8 text-simon-green bg-slate-50" />
            {!isCollapsed && <span className="text-xl font-bold text-simon-blue">Simon</span>}
          </Link>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="bg-slate-50">Hoofdmenu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Admin-only tools */}
              <AdminOnly>
                {adminToolsItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
              </AdminOnly>
              
              {/* Regular tools */}
              {toolsItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section (Only visible to admins) */}
        <AdminOnly>
          <SidebarGroup>
            <SidebarGroupLabel>Beheer</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </AdminOnly>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}