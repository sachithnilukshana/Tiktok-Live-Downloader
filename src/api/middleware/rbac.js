const RANK = { VIEWER: 0, OPERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };

/**
 * requireRole('ADMIN') — user must have ADMIN or higher.
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = RANK[req.user?.role] ?? -1;
    const minRank = RANK[minRole] ?? 0;
    if (userRank < minRank) {
      return res.status(403).json({ error: `Requires ${minRole} or higher` });
    }
    next();
  };
}

export const isSuperAdmin = requireRole('SUPER_ADMIN');
export const isAdmin = requireRole('ADMIN');
export const isOperator = requireRole('OPERATOR');
export const isViewer = requireRole('VIEWER');
