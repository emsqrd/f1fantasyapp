export interface InfoRoleCardContentProps {
  name: string;
}
export function InfoRoleCardContent({ name }: InfoRoleCardContentProps) {
  return (
    <div className="flex w-full">
      <span className="aspect-square w-14 self-center rounded-full border-2 border-gray-300"></span>
      <div className="flex flex-1 flex-col items-start justify-between pl-4">
        <h3 className="text-lg font-bold">{name}</h3>
      </div>
    </div>
  );
}
