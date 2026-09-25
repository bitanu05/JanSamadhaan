import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import HomeClient from "./HomeClient";

interface SearchParams {
  tab?: string;
  category?: string;
  search?: string;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const activeTab = params.tab || "problems";
  const selectedCategory = params.category || "";
  const searchQuery = params.search || "";

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const [problemCount, solutionCount, partnershipCount] = await Promise.all([
    prisma.problem.count({ where: { isDeleted: false } }),
    prisma.solution.count({ where: { problem: { isDeleted: false } } }),
    prisma.partnership.count({
      where: { solution: { problem: { isDeleted: false } } },
    }),
  ]);

  // ── Problems feed ─────────────────────────────────────────────────────────
  const problemWhere: Record<string, unknown> = {
    approvalStatus: "APPROVED",
    isDeleted: false,
  };
  if (selectedCategory) problemWhere.category = selectedCategory;
  if (searchQuery) {
    problemWhere.OR = [
      { title: { contains: searchQuery } },
      { description: { contains: searchQuery } },
      { location: { contains: searchQuery } },
    ];
  }

  const problems = await prisma.problem.findMany({
    where: problemWhere,
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      postedBy: { select: { id: true, name: true } },
      _count: { select: { solutions: true } },
    },
  });

  // ── Solutions feed ────────────────────────────────────────────────────────
  const solutionWhere: Record<string, unknown> = {
    problem: { approvalStatus: "APPROVED", isDeleted: false },
  };
  if (selectedCategory) {
    solutionWhere.problem = {
      category: selectedCategory,
      approvalStatus: "APPROVED",
      isDeleted: false,
    };
  }
  if (searchQuery) {
    solutionWhere.OR = [
      { title: { contains: searchQuery } },
      { description: { contains: searchQuery } },
      {
        problem: {
          title: { contains: searchQuery },
          approvalStatus: "APPROVED",
          isDeleted: false,
        },
      },
      { university: { name: { contains: searchQuery } } },
    ];
  }

  const solutions = await prisma.solution.findMany({
    where: solutionWhere,
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      university: { select: { id: true, name: true } },
      problem: {
        select: {
          id: true,
          title: true,
          category: true,
          location: true,
          status: true,
        },
      },
      _count: { select: { partnerships: true } },
    },
  });

  // ── Partnerships feed ─────────────────────────────────────────────────────
  const partnershipWhere: Record<string, unknown> = {
    solution: { problem: { approvalStatus: "APPROVED", isDeleted: false } },
  };
  if (selectedCategory) {
    partnershipWhere.solution = {
      problem: { category: selectedCategory, approvalStatus: "APPROVED" },
    };
  }
  if (searchQuery) {
    partnershipWhere.OR = [
      { proposalDetails: { contains: searchQuery } },
      { industry: { name: { contains: searchQuery } } },
      { solution: { title: { contains: searchQuery } } },
    ];
  }

  const partnerships = await prisma.partnership.findMany({
    where: partnershipWhere,
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      industry: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      solution: {
        include: {
          university: { select: { id: true, name: true } },
          problem: {
            select: { id: true, title: true, category: true, location: true },
          },
        },
      },
    },
  });

  return (
    <>
      <Navbar role={session?.role} userName={session?.name} />
      <HomeClient
        session={session}
        problemCount={problemCount}
        solutionCount={solutionCount}
        partnershipCount={partnershipCount}
        problems={problems}
        solutions={solutions}
        partnerships={partnerships}
        activeTab={activeTab}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
      />
    </>
  );
}
