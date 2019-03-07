import {reactStyles, withStyle} from 'app/utils';

const baseStyles = reactStyles({
  card: {
    padding: '1rem',
    borderRadius: '0.2rem',
    boxShadow: '0 0.125rem 0.125rem 0 #d7d7d7',
    backgroundColor: '#fff',
    border: '1px solid #d7d7d7',
    display: 'flex',
    flexDirection: 'column',
    margin: '0 1rem 1rem 0'
  }
});

export const styles = reactStyles({
  workspaceCard: {
    ...baseStyles.card,
    minWidth: '300px', maxWidth: '300px',
    minHeight: '223px', maxHeight: '223px',
  },
  resourceCard: {
    ...baseStyles.card,
    minWidth: '200px', maxWidth: '200px',
    minHeight: '223px', maxHeight: '223px'
  }
});

export const WorkspaceCardBase = withStyle(styles.workspaceCard)('div');
export const ResourceCardBase = withStyle(styles.resourceCard)('div');
