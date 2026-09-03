package services

import (
	"reflect"
	"testing"
)

func TestParseTilePoolsNormalizesAndSortsSavedPools(t *testing.T) {
	pools := ParseTilePools(`[
		{"name":"  Zoo trip  ","items":"zebra"},
		{"name":"","items":"discard"},
		{"name":"apple trip","items":"apple"}
	]`)

	want := []TilePool{
		{Name: "apple trip", Items: "apple"},
		{Name: "Zoo trip", Items: "zebra"},
	}
	if !reflect.DeepEqual(pools, want) {
		t.Fatalf("parsed pools = %#v, want %#v", pools, want)
	}
}

func TestParseTilePoolsRejectsInvalidOrEmptyStorage(t *testing.T) {
	for _, value := range []string{"", "not json", `{\"name\":\"not an array\"}`} {
		if pools := ParseTilePools(value); len(pools) != 0 {
			t.Fatalf("ParseTilePools(%q) = %#v, want no pools", value, pools)
		}
	}
}

func TestNormalizeTilePoolsDoesNotMutateInput(t *testing.T) {
	input := []TilePool{
		{Name: "  Road trip  ", Items: "first"},
		{Name: "Beach", Items: "second"},
	}

	got := NormalizeTilePools(input)
	if input[0].Name != "  Road trip  " {
		t.Fatalf("input was mutated: %#v", input)
	}
	if got[0].Name != "Beach" || got[1].Name != "Road trip" {
		t.Fatalf("normalized order = %#v, want Beach then Road trip", got)
	}
}
