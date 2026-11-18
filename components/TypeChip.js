import Icon from './Icon';

export default function TypeChip({ type }) {
  return type === 'auto' ? (
    <span className="type-chip auto"><Icon name="loop" size={12} />Automated</span>
  ) : (
    <span className="type-chip"><Icon name="lock" size={12} />Certificate</span>
  );
}

