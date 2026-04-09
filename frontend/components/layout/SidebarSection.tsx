"use client";

import Link from "next/link";
import styles from "@/components/layout/Sidebar.module.css";
import { SidebarItem } from "@/components/layout/sidebar-menu.data";

type SidebarSectionProps = {
  item: SidebarItem;
  pathname: string;
  expanded: Record<string, boolean>;
  activeId: string;
  depth: number;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
};

function routeActive(pathname: string, route?: string): boolean {
  if (!route) return false;
  if (pathname === route) return true;
  return pathname.startsWith(`${route}/`);
}

function hasActiveDescendant(item: SidebarItem, pathname: string): boolean {
  if (routeActive(pathname, item.route)) return true;
  if (!item.children || item.children.length === 0) return false;
  return item.children.some((child) => hasActiveDescendant(child, pathname));
}

export function SidebarSection({ item, pathname, expanded, activeId, depth, onToggle, onActivate }: SidebarSectionProps) {
  const hasChildren = !!item.children?.length;
  const isExpanded = !!expanded[item.id];
  const isRouteActive = routeActive(pathname, item.route) || hasActiveDescendant(item, pathname);
  const isStateActive = activeId === item.id;
  const isActive = isRouteActive || isStateActive;

  if (!hasChildren && item.route) {
    return (
      <Link
        href={item.route}
        onClick={() => onActivate(item.id)}
        className={`${styles.item} ${isActive ? styles.itemActive : ""} ${depth > 0 ? styles.subItem : ""}`}
      >
        <span className={styles.itemLabel}>
          {item.icon ? <img src={item.icon} alt="" className={styles.itemIcon} aria-hidden="true" /> : null}
          <span>{item.name}</span>
        </span>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onActivate(item.id);
          onToggle(item.id);
        }}
        className={`${styles.item} ${isActive ? styles.itemActive : ""} ${depth > 0 ? styles.subItem : ""}`}
      >
        <span className={styles.itemLabel}>
          {item.icon ? <img src={item.icon} alt="" className={styles.itemIcon} aria-hidden="true" /> : null}
          <span>{item.name}</span>
        </span>
        {hasChildren ? <span className={styles.caret}>{isExpanded ? "-" : "+"}</span> : null}
      </button>
      {hasChildren && isExpanded ? (
        <div className={styles.children}>
          {item.children?.map((child) => (
            <SidebarSection
              key={child.id}
              item={child}
              pathname={pathname}
              expanded={expanded}
              activeId={activeId}
              depth={depth + 1}
              onToggle={onToggle}
              onActivate={onActivate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
