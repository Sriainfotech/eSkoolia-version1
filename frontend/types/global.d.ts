declare module "*.css";

declare module "@/hooks/useCurrentAcademicYear" {
	export function useCurrentAcademicYear(fallback?: string): {
		year: string;
		loading: boolean;
	};

	export default useCurrentAcademicYear;
}

declare module "@/components/competitions/InspireHubButton" {
	const InspireHubButton: (props: any) => JSX.Element;
	export default InspireHubButton;
}

declare module "@/components/competitions/InspireHubModal" {
	const InspireHubModal: (props: any) => JSX.Element;
	export default InspireHubModal;
}

declare module "@/lib/utils/pluralize" {
	export function pluralize(count: number, singular: string, plural?: string): string;

	export default pluralize;
}
declare module "mammoth/mammoth.browser.js" {
  const mammoth: any;
  export default mammoth;
}

declare module "@/lib/competitionsApi" {
  export const competitionsApi: any;
}