import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-red.png";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-2">
          <img src={logo} alt="Invoicemonk" className="h-8 w-auto" />
        </a>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#compliance" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Compliance
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <a href="https://app.invoicemonk.com/login">Log in</a>
          </Button>
          <Button variant="default" size="sm" asChild>
            <a href="https://app.invoicemonk.com/signup">Get Started</a>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
