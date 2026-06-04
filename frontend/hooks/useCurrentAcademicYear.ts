import { useState, useEffect } from 'react';

export function useCurrentAcademicYear(fallbackYear: string) {
  const [year, setYear] = useState(fallbackYear);

  useEffect(() => {
    // You can replace this with an actual API call to fetch the current academic year if needed.
    // For now, it just returns the fallback year.
    setYear(fallbackYear);
  }, [fallbackYear]);

  return { year };
}
