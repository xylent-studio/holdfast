import { NavLink } from 'react-router-dom';

import { NAV_ITEMS } from '@/domain/constants';

interface BottomNavProps {
  viewPath: string;
}

export function BottomNav({ viewPath }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `bottom-nav-link ${isActive || viewPath === item.path ? 'active' : ''}`
          }
          key={item.path}
          to={item.path}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
