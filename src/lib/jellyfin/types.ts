export interface JellyfinPerson {
  Id: string;
  Name: string;
  Type: 'Actor' | 'Director' | 'Writer' | 'Producer' | string;
  Role?: string;
  PrimaryImageTag?: string;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Season' | 'Episode' | 'BoxSet';
  Tags?: string[];
  Overview?: string;
  ProductionYear?: number;
  PremiereDate?: string;
  CommunityRating?: number;
  CriticRating?: number;
  RunTimeTicks?: number;
  OfficialRating?: string;
  Taglines?: string[];
  Genres?: string[];
  ProviderIds?: Record<string, string>;
  Status?: string;
  EpisodeCount?: number;
  ChildCount?: number;
  People?: JellyfinPerson[];
  Studios?: Array<{ Name: string; Id: string }>;
  ImageTags: {
    Primary?: string;
    Thumb?: string;
    Logo?: string;
  };
  BackdropImageTags?: string[];
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentId?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentLogoItemId?: string;
  ParentLogoImageTag?: string;
  DateCreated?: string;
  SortName?: string;
  resolvedDays?: number; // set by enrichLeavingSoon, overrides tag-derived days
}

export interface Library {
  Name: string;
  ItemId: string;
  CollectionType: string;
}
