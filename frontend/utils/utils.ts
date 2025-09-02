export const getStatusColor = (status: string) => {
  switch (status) {
    case "online":
      return "bg-green-500"
    case "busy":
      return "bg-yellow-500"
    case "offline":
      return "bg-red-500"
    default:
      return "bg-gray-500"
  }
}

export const getStatusVariant = (status: string) => {
  switch (status) {
    case "online":
      return "default"
    case "busy":
      return "secondary"
    case "offline":
      return "destructive"
    default:
      return "outline"
  }
}
