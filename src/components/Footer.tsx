import logo from "@/assets/logo-black.png";

const Footer = () => {
  return (
    <footer className="py-12 border-t border-border/50">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Invoicemonk" className="h-6 w-auto" />
          </div>
          
          <nav className="flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#compliance" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Compliance
            </a>
            <a href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
          </nav>
          
          <p className="text-sm text-muted-foreground">
            © 2026 Invoicemonk. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
