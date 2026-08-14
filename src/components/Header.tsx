import { Button, Tooltip } from 'tdesign-react';
import { SunnyIcon, MoonIcon, MenuFoldIcon, MenuUnfoldIcon, SettingIcon } from 'tdesign-icons-react';
import { Theme } from '../types';

interface HeaderProps {
  title: string;
  sidebarOpen: boolean;
  theme: Theme;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenSettings?: () => void;
}

export function Header({
  title,
  sidebarOpen,
  theme,
  onToggleSidebar,
  onToggleTheme,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header
      className="h-14 flex justify-between items-center px-4 flex-shrink-0"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      <div className="flex items-center gap-3">
        <Button
          className="hidden md:inline-flex"
          variant="text"
          shape="circle"
          icon={sidebarOpen ? <MenuFoldIcon /> : <MenuUnfoldIcon />}
          onClick={onToggleSidebar}
        />
        <h1
          className="text-base font-semibold truncate"
          style={{ color: 'var(--td-text-color-primary)' }}
        >
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {onOpenSettings && (
          <Button
            className="md:hidden"
            variant="outline"
            shape="circle"
            icon={<SettingIcon />}
            onClick={onOpenSettings}
          />
        )}
        <Tooltip content={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
          <Button
            variant="outline"
            shape="circle"
            icon={theme === 'light' ? <MoonIcon /> : <SunnyIcon />}
            onClick={onToggleTheme}
          />
        </Tooltip>
      </div>
    </header>
  );
}
