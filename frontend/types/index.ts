export interface Profile {
  id: string;
  username: string;
  research_field: string;
  focus_areas: string[];
  writing_style: string;
  api_key_configured: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  topic: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
}
