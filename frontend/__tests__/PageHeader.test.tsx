/**
 * Tests — PageHeader Component
 * ==============================
 * Verifies the shared header renders correctly across all ERP pages
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/PageHeader';

const defaultProps = {
  module: { name: 'Students', path: '/students' },
  title: 'Student List',
};

describe('PageHeader', () => {
  it('renders the page title', () => {
    render(<PageHeader {...defaultProps} />);
    expect(screen.getByText('Student List')).toBeInTheDocument();
  });

  it('renders the module name in breadcrumb', () => {
    render(<PageHeader {...defaultProps} />);
    expect(screen.getByText('Students')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<PageHeader {...defaultProps} description="Manage all students" />);
    expect(screen.getByText('Manage all students')).toBeInTheDocument();
  });

  it('renders titleAccent alongside title', () => {
    render(<PageHeader {...defaultProps} titleAccent="(Active)" />);
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });

  it('renders action buttons when provided', () => {
    render(
      <PageHeader
        {...defaultProps}
        actions={<button>Add Student</button>}
      />
    );
    expect(screen.getByRole('button', { name: /add student/i })).toBeInTheDocument();
  });

  it('renders tabs when provided', () => {
    const tabs = [
      { label: 'All Students', href: '/students' },
      { label: 'Inactive', href: '/students?status=inactive' },
    ];
    render(<PageHeader {...defaultProps} tabs={tabs} activeTab="All Students" />);
    expect(screen.getByText('All Students')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders Home link in breadcrumb', () => {
    render(<PageHeader {...defaultProps} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
