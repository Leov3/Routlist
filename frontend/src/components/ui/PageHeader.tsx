interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-on-surface-variant sm:text-[15px]">{description}</p>}
      </div>
      {action && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3 lg:shrink-0">{action}</div>}
    </div>
  );
}
