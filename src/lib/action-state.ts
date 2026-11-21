export interface ExistingRecipeSummary {
  id: string;
  title: string;
  archived: boolean;
}

export interface ActionState {
  error?: string;
  message?: string;
  inviteUrl?: string;
  existingRecipe?: ExistingRecipeSummary;
}
