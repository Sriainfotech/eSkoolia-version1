"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "@/components/layout/Sidebar.module.css";
import { sidebarMenu, SidebarItem } from "@/components/layout/sidebar-menu.data";
import { SidebarSection } from "@/components/layout/SidebarSection";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type MePayload = {
  is_superuser: boolean;
  is_school_admin: boolean;
  permission_codes: string[];
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

function buildDefaultExpanded(items: SidebarItem[], pathname: string): Record<string, boolean> {
  const map: Record<string, boolean> = {};

  const walk = (nodes: SidebarItem[]) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        if (hasActiveDescendant(node, pathname)) {
          map[node.id] = true;
        }
        walk(node.children);
      }
    });
  };

  walk(items);
  return map;
}

function findActiveId(items: SidebarItem[], pathname: string): string {
  for (const item of items) {
    if (routeActive(pathname, item.route)) {
      return item.id;
    }
    if (item.children && item.children.length > 0) {
      const childMatch = findActiveId(item.children, pathname);
      if (childMatch) return childMatch;
    }
  }
  return "";
}

function routeToPermissionPrefixes(route?: string): string[] {
  if (!route) return [];
  if (route.startsWith("/roles")) return ["access_control", "role_permission", "system_settings"];
  if (route.startsWith("/administration") || route.startsWith("/admissions")) return ["admin_section", "admissions"];
  if (route.startsWith("/students")) return ["student_info", "students"];
  if (route.startsWith("/attendance")) return ["student_info", "attendance"];
  if (route.startsWith("/academics") || route.startsWith("/lesson") || route.startsWith("/setup")) return ["academics", "core", "settings", "settings_section"];
  if (route.startsWith("/exams")) return ["examination", "exams", "exam"];
  if (route.startsWith("/fees")) return ["fees"];
  if (route.startsWith("/library")) return ["library"];
  if (route.startsWith("/transport")) return ["transport"];
  if (route.startsWith("/inventory")) return ["inventory"];
  if (route.startsWith("/utilities")) return ["utilities"];
  if (route.startsWith("/hr")) return ["hr", "human_resource"];
  if (route.startsWith("/finance")) return ["finance", "accounts"];
  return [];
}

function hasAnyPermissionForRoute(route: string | undefined, permissionCodes: Set<string>): boolean {
  if (!route || route === "/dashboard") return true;
  const prefixes = routeToPermissionPrefixes(route);
  if (prefixes.length === 0) return true;
  for (const code of permissionCodes) {
    for (const prefix of prefixes) {
      if (code === "*" || code.startsWith(`${prefix}.`)) {
        return true;
      }
    }
  }
  return false;
}

function filterSidebarByPermissions(items: SidebarItem[], me: MePayload): SidebarItem[] {
  if (me.is_superuser || me.is_school_admin) {
    return items;
  }

  const permissionCodes = new Set((me.permission_codes || []).filter(Boolean));
  if (permissionCodes.size === 0) {
    // Keep menu visible if permission catalog is not seeded yet.
    return items;
  }

  const walk = (nodes: SidebarItem[]): SidebarItem[] => {
    const output: SidebarItem[] = [];
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        const children = walk(node.children);
        if (children.length > 0) {
          output.push({ ...node, children });
        }
        continue;
      }

      if (hasAnyPermissionForRoute(node.route, permissionCodes)) {
        output.push(node);
      }
    }
    return output;
  };

  return walk(items);
}

export function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState("");
  const [menuItems, setMenuItems] = useState<SidebarItem[]>(sidebarMenu);

  useEffect(() => {
    let mounted = true;

    const loadMenu = async () => {
      try {
        const me = await apiRequestWithRefresh<MePayload>("/api/v1/auth/me/");
        if (!mounted) return;
        setMenuItems(filterSidebarByPermissions(sidebarMenu, me));
      } catch {
        if (!mounted) return;
        setMenuItems(sidebarMenu);
      }
    };

    void loadMenu();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setExpanded(buildDefaultExpanded(menuItems, pathname));
    const selectedFromRoute = findActiveId(menuItems, pathname);
    if (selectedFromRoute) {
      setActiveId(selectedFromRoute);
      setExpanded((prev) => ({ ...buildDefaultExpanded(menuItems, pathname), ...prev }));
    } else {
      setActiveId("");
    }
  }, [pathname, menuItems]);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-mobile-backdrop" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside className={`${styles.aside}${mobileOpen ? ` ${styles.asideMobileOpen}` : ''}`}>
      <a href="/dashboard" className={styles.brandLink}>
        <div className={styles.brand}>Eskoolia</div>
      </a>
      <div className={styles.nav}>
        {menuItems.map((item) => (
          <SidebarSection
            key={item.id}
            item={item}
            pathname={pathname}
            expanded={expanded}
            activeId={activeId}
            depth={0}
            onToggle={toggle}
            onActivate={setActiveId}
          />
        ))}
      </div>
      </aside>
    </>
  );
}
