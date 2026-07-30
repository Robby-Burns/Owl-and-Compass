variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_key" {
  description = "Supabase anon/public key"
  type        = string
  sensitive   = true
}

variable "http_port" {
  description = "Port that the container should expose on the host"
  type        = number
  default     = 3000
}
