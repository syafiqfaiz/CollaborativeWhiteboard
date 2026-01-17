interface UserListProps {
  users: string[];
}

export function UserList({ users }: UserListProps) {
  return (
    <div className="fixed top-4 right-4 bg-white/90 shadow-lg rounded-lg p-3 w-48 border border-gray-200">
      <h3 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">Active Users ({users.length})</h3>
      <ul className="max-h-40 overflow-y-auto">
        {users.map((name, index) => (
          <li key={index} className="text-sm text-gray-600 truncate py-0.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
