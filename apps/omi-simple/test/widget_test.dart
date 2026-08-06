import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omi_simple/main.dart';

void main() {
  test('constructs the Omi application shell', () {
    expect(const OmiSimpleApp(), isA<StatelessWidget>());
  });
}
