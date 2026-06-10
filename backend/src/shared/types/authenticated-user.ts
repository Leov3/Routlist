export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: string;
  permissions: string[];
};
