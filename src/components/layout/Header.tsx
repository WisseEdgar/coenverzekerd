import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileDropdown } from "./ProfileDropdown";
export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user, loading, signOut } = useAuth();
  const navigation = [{
    name: "Features",
    href: "/features"
  }, {
    name: "Pricing",
    href: "/pricing"
  }, {
    name: "Contact",
    href: "/contact"
  }];
  const isActive = (path: string) => location.pathname === path;
  return <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-xl font-bold text-coenverzekerd-blue">Coenverzekerd</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map(item => <Link key={item.name} to={item.href} className={`text-sm font-medium transition-colors ${isActive(item.href) ? "text-coenverzekerd-green" : "text-muted-foreground hover:text-foreground"}`}>
                {item.name}
              </Link>)}
          </nav>

          {/* Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {loading ? (
              <div className="w-8 h-8 animate-pulse bg-muted rounded-full" />
            ) : user ? (
              <ProfileDropdown />
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="coenverzekerd" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-border">
              {navigation.map(item => <Link key={item.name} to={item.href} className={`block px-3 py-2 text-base font-medium transition-colors ${isActive(item.href) ? "text-coenverzekerd-green" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setIsMenuOpen(false)}>
                  {item.name}
                </Link>)}
              <div className="flex flex-col space-y-2 pt-4">
                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full">
                        Dashboard
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={() => {
                        setIsMenuOpen(false);
                        signOut();
                      }}
                    >
                      Uitloggen
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="coenverzekerd" size="sm" className="w-full">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>}
      </div>
    </header>;
};