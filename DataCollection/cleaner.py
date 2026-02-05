import argparse
import csv
import re
import unicodedata
from pathlib import Path


DEFAULT_INPUTS = [
	Path(__file__).resolve().parent.parent / "data" / "nftm_fork.csv",
	Path(__file__).resolve().parent.parent / "data" / "differential_solver.csv",
]

OUTPUT_COLUMNS = [
	"repo_full_name",
	"sha",
	"parent_shas",
	"branch",
	"author_name",
	"commit_day",
	"commit_hour",
	"message_type",
	"message_argument",
	"message_message",
	"nomenclature",
]

ALLOWED_TYPES = {
	"feat",
	"fix",
	"chore",
	"docs",
	"doc",
	"style",
	"refactor",
	"test",
	"perf",
	"ci",
}


def split_message(msg: str | None):
	if msg is None:
		return None, None, None
	msg = normalize_text(str(msg).strip())
	if msg == "":
		return None, None, None
	before = None
	between = None
	after = msg
	before_match = re.match(r"^(.*?)\s*\(", msg)
	if before_match:
		before = normalize_text(before_match.group(1).strip().lower())
		between_match = re.search(r"\((.*?)\)", msg)
		if between_match:
			between = normalize_text(between_match.group(1).strip().lower())
			after_start = between_match.end()
			after_part = msg[after_start:].strip()
			if ":" in after_part:
				after = normalize_text(after_part.split(":", 1)[1].strip())
			else:
				after = normalize_text(after_part)
	if ":" in msg and after == msg:
		after = normalize_text(msg.split(":", 1)[1].strip())
	return before, between, after


def normalize_text(value: str) -> str:
	if value == "":
		return ""
	normalized = unicodedata.normalize("NFKD", value)
	return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_row(row: dict) -> dict:
	commit_day = row.get("commit_day") or ""
	commit_hour = row.get("commit_hour") or ""
	commit_date = row.get("commit_date") or ""

	if not commit_day and commit_date:
		commit_day = commit_date.split(" ")[0]
	if (commit_hour in ("", None)) and commit_date:
		parts = commit_date.split(" ")
		if len(parts) > 1:
			commit_hour = parts[1].split(":")[0]

	message = row.get("message")
	message_type = row.get("message_type")
	message_argument = row.get("message_argument")
	message_message = row.get("message_message")

	if not (message_type or message_argument or message_message):
		message_type, message_argument, message_message = split_message(message)

	nomenclature = 0
	if message_type and str(message_type).strip().lower() in ALLOWED_TYPES:
		nomenclature = 1

	return {
		"repo_full_name": normalize_text((row.get("repo_full_name") or "").strip()),
		"sha": normalize_text((row.get("sha") or "").strip()),
		"parent_shas": normalize_text((row.get("parent_shas") or "").strip()),
		"branch": normalize_text((row.get("branch") or "").strip()),
		"author_name": normalize_text((row.get("author_name") or "").strip()),
		"commit_day": commit_day,
		"commit_hour": commit_hour,
		"message_type": normalize_text(message_type or ""),
		"message_argument": normalize_text(message_argument or ""),
		"message_message": normalize_text(message_message or ""),
		"nomenclature": nomenclature,
	}


def merge_csv(inputs: list[Path], output: Path) -> int:
	rows_written = 0
	output.parent.mkdir(parents=True, exist_ok=True)

	with output.open("w", newline="", encoding="utf-8") as f_out:
		writer = csv.DictWriter(f_out, fieldnames=OUTPUT_COLUMNS)
		writer.writeheader()

		for path in inputs:
			if not path.exists():
				continue
			with path.open("r", newline="", encoding="utf-8-sig") as f_in:
				reader = csv.DictReader(f_in)
				for row in reader:
					writer.writerow(normalize_row(row))
					rows_written += 1

	return rows_written


def main() -> None:
	parser = argparse.ArgumentParser(description="Merge and clean commit CSV files.")
	parser.add_argument(
		"inputs",
		nargs="*",
		help="Input CSV files. If omitted, default datasets are used.",
	)
	parser.add_argument(
		"-o",
		"--output",
		default=str(Path(__file__).resolve().parent.parent / "data" / "commits_history_cleaned.csv"),
		help="Output CSV file path.",
	)
	args = parser.parse_args()

	input_paths = [Path(p) for p in args.inputs] if args.inputs else DEFAULT_INPUTS
	rows = merge_csv(input_paths, Path(args.output))
	print(f"Merged {rows} rows into {args.output}")


if __name__ == "__main__":
	main()
