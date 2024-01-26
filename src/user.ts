export interface Profile {
  id: string;
  avatar: string;
  description: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  profile: Profile;
}
