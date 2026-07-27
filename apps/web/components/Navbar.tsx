'use client';

import { Bell, Search, User, Menu } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-muted-foreground hover:text-foreground">
          <Menu className="h-6 w-6" />
        </button>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Tìm kiếm sinh viên, lớp học..." 
            className="pl-9 pr-4 py-2 border border-input rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary w-64 bg-muted/30"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-secondary ring-2 ring-white"></span>
        </button>
        
        <div className="h-8 w-px bg-border"></div>
        
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">Nguyễn Văn A</p>
            <p className="text-xs text-muted-foreground mt-1">Quản trị viên</p>
          </div>
          <div className="h-9 w-9 rounded-sm bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
