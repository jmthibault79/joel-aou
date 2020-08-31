import WorkspacesPage from 'app/page/workspaces-page';
import {findWorkspace, signIn} from 'utils/test-utils';
import WorkspaceCard from 'app/component/workspace-card';
import {EllipsisMenuAction, WorkspaceAccessLevel} from 'app/text-labels';


describe('Delete workspace', () => {

  beforeEach(async () => {
    await signIn(page);
  });

  /**
   * Test
   * - Navigate to "Your Workspaces" page   
   * - Find an existing workspace. Create a new workspace if none exists.
   * - Select "Delete" thru the Ellipsis menu located on the Workspace card.
   * - Get the content on the modal
   * - Click the delete workspace button on the confirmation dialog
   * - Navigate to the "View Workspaces" page
   * - Verify that the workspace has been delete
   */
  
  describe('From "Your Workspaces" page using Workspace card ellipsis menu', () => {

    test('As OWNER, user can delete workspace', async () => {
      const workspacesPage = new WorkspacesPage(page);
      const workspaceCard = await findWorkspace(page);
      const workspaceName = await workspaceCard.getWorkspaceName();
      console.log(workspaceName);

      // Verify Workspace Access Level is OWNER.
      const accessLevel = await workspaceCard.getWorkspaceAccessLevel();
      expect(accessLevel).toBe(WorkspaceAccessLevel.Owner);
      
      await workspaceCard.asElementHandle().hover();

      // click on Ellipsis "Delete"
      await (workspaceCard.getEllipsis()).clickAction(EllipsisMenuAction.Delete, { waitForNav: false });

      // click the delete workspace button on the confirmation dialog
      await workspacesPage.deleteWorkspaceModal();

      // navigate to "Your Workspaces" page
      await workspacesPage.isLoaded(); 

      // Verify if the delete workspace action was successful.
      expect(await WorkspaceCard.findCard(page, workspaceName)).toBeFalsy();
    });
  });   

   /**
    * Test:
    * - Find an existing workspace. Create a new workspace if none exists.
    * - Click on the workspace card
    * - Navigate to the Data Page
    * - Select "Delete" thru the Ellipsis menu located inside the Workspace Action menu
    * - Get the content on the modal
    * - Click the delete workspace button
    * - Navigate to the "View Workspaces" page
    * - Verify that the workspace has been delete
    */

  // describe.('From "Data" page using side ellipsis menu', () => {

  //   test('As OWNER, user can delete workspace', async () => {

  //   });
  // });
});
