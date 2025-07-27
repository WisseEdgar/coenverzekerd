import React from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ShieldOff, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children, fallback }) => {
  const { isAdmin, loading, error } = useAdmin();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>Toegangsrechten controleren...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Fout bij toegangscontrole
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Terug naar Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="container mx-auto p-6">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <ShieldOff className="h-5 w-5" />
              Toegang Geweigerd
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-600 mb-4">
              Je hebt geen beheerderrechten om deze pagina te bekijken.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Terug naar Dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate('/auth')}>
                Uitloggen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin indicator */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-700">
          <Shield className="h-4 w-4" />
          <span className="text-sm font-medium">Beheerder Mode Actief</span>
        </div>
      </div>
      {children}
    </div>
  );
};