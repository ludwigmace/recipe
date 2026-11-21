export interface ActionState {
  error?: string;
  message?: string;
  inviteUrl?: string;
  existingRecipe?: { id: string; title: string };
}
