import AdminSectionNav from '@/components/admin/AdminSectionNav';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <AdminSectionNav />
      <div>{children}</div>
    </div>
  );
}
