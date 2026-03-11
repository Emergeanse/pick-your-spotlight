import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-serif">404</h1>
        <p className="mb-4 text-base text-muted-foreground font-sans">Page introuvable</p>
        <a href="/" className="text-primary underline hover:text-primary/80 text-sm font-sans">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
};

export default NotFound;
