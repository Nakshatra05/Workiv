// Company Profile (one per wallet for employers)
export interface CompanyProfile {
  id: string;
  owner: string; // Wallet address
  name: string;
  description: string;
  industry: string;
  website?: string;
  logo?: string;
  location: string;
  size: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";
  founded_year?: number;
  linkedin_url?: string;
  twitter_url?: string;
  created_at: number;
  updated_at: number;
}

// Job Listing disciplines/categories
export type JobDiscipline = 
  | "engineering"
  | "design"
  | "product"
  | "marketing"
  | "sales"
  | "operations"
  | "finance"
  | "hr"
  | "legal"
  | "customer-support"
  | "data-science"
  | "devops"
  | "other";

// Job Listing location types
export type LocationType = "remote" | "hybrid" | "onsite";

// Job Listing status
export type JobStatus = "active" | "filled" | "expired" | "draft";

// Job Listing (formerly Post)
export interface JobListing {
  id: string;
  owner: string; // Company/poster wallet
  title: string;
  description: string;
  company: string;
  company_id?: string; // Reference to CompanyProfile
  location: string;
  location_type: LocationType;
  salary_range?: string;
  salary_min?: number;
  salary_max?: number;
  job_type: "full-time" | "part-time" | "contract" | "freelance" | "internship";
  discipline: JobDiscipline;
  remote: boolean;
  apply_link?: string;
  media_id: string;
  applications: string[];
  saved_by: string[];
  flags: string[]; // Wallet addresses that flagged this listing
  status: JobStatus;
  expires_at: number; // Timestamp when job expires
  expiration_days: 30 | 60 | 90;
  created_at: number;
  updated_at: number;
  image?: {
    dataUrl: string;
    filename: string;
    contentType: string;
    fileSize: number;
  };
}

// Keep Post as alias for backward compatibility with API routes
export interface Post {
  id: string;
  owner: string;
  caption: string;
  media_id: string;
  likes: string[];
  comments: string[];
  created_at: number;
  updated_at: number;
  image?: {
    dataUrl: string;
    filename: string;
    contentType: string;
    fileSize: number;
  };
}

export interface JobImage {
  dataUrl: string;
  filename: string;
  contentType: string;
  fileSize: number;
}

export type ProfilePayload = {
  wallet?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  headline?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  portfolio_url?: string;
  linkedin_url?: string;
  github_url?: string;
  user_type?: "job_seeker" | "employer";
  expiresInKey?: string;
};

export type CompleteProfilePayload = Required<
  Pick<ProfilePayload, "wallet" | "displayName" | "bio" | "avatar">
> & {
  headline?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  portfolio_url?: string;
  linkedin_url?: string;
  github_url?: string;
  user_type?: "job_seeker" | "employer";
  expiresInKey?: string;
  createdAt?: number;
  updatedAt?: number;
  version?: number;
};

export interface ChunkEntity {
  id: string;
  media_id: string;
  chunk_index: number;
  data: Buffer;
  checksum: string;
  created_at: Date;
  expiration_block: number;
}

export interface MediaChunk {
  media_id: string;
  chunk_index: number;
  data: string; // Base64 encoded data
  checksum: string;
  expiration_block: number;
}

export interface MediaMetadata {
  media_id: string;
  filename: string;
  content_type: string;
  file_size: number;
  chunk_count: number;
  checksum: string;
  created_at: Date;
  expiration_block: number;
  btl_days: number;
}

export interface UploadSession {
  media_id: string;
  idempotency_key: string;
  metadata: MediaMetadata;
  chunks_received: Set<number>;
  completed: boolean;
}

export interface QuotaInfo {
  used_bytes: number;
  max_bytes: number;
  uploads_today: number;
  max_uploads_per_day: number;
}

// Application (formerly Comment) - Job applications
export interface Application {
  id: string;
  job_id: string;
  applicant: string;
  cover_letter: string;
  resume_url?: string;
  portfolio_url?: string;
  status: "pending" | "reviewed" | "shortlisted" | "rejected" | "hired";
  created_at: number;
  updated_at: number;
  replies: string[];
  parent_application_id?: string;
}

// Keep Comment interface for backward compatibility
export interface Comment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  created_at: number;
  updated_at: number;
  likes: string[];
  replies: string[];
  parent_comment_id?: string;
}

// Featured Job (formerly Story) - Highlighted/promoted jobs
export interface FeaturedJob {
  id: string;
  author: string;
  media_id: string;
  title: string;
  company: string;
  highlight?: string;
  created_at: number;
  expires_at: number;
  views: string[];
  type: "featured" | "urgent" | "trending";
  media?: {
    dataUrl: string;
    filename: string;
    contentType: string;
    fileSize: number;
  };
}

// Keep Story interface for backward compatibility
export interface Story {
  id: string;
  author: string;
  media_id: string;
  content?: string;
  created_at: number;
  expires_at: number;
  views: string[];
  type: "image" | "video";
  media?: {
    dataUrl: string;
    filename: string;
    contentType: string;
    fileSize: number;
  };
}

export const CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25 MB
  CHUNK_SIZE: 64 * 1024, // 64 KB per chunk
  DEFAULT_BTL_DAYS: 7,
  FREE_TIER_MAX_BYTES: 100 * 1024 * 1024, // 100 MB
  FREE_TIER_MAX_UPLOADS_PER_DAY: 10,
  BLOCKS_PER_DAY: 43200, // Arkiv block timing (2-second blocks)
};
