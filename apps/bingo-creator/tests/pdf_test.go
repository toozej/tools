package tests

import (
	"os"
	"os/exec"
	"testing"
)

func TestPDFExport(t *testing.T) {
	// Read both files so Go invalidates the test cache when JavaScript changes.
	for _, path := range []string{"../static/app.js", "pdf.test.cjs"} {
		if _, err := os.ReadFile(path); err != nil {
			t.Fatal(err)
		}
	}

	output, err := exec.Command("node", "pdf.test.cjs").CombinedOutput()
	t.Log(string(output))
	if err != nil {
		t.Fatalf("PDF export tests failed (Node.js 18 or later is required): %v", err)
	}
}
